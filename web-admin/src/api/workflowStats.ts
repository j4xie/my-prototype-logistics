/**
 * Workflow Stats API — U-NAV-1 业务流程图导航数据源.
 *
 * 后端 WorkflowStatsController 5 endpoint, 5min Redis 缓存.
 * baseURL = /api/mobile (request.ts), 实际 URL = /api/mobile/{factoryId}/workflow-stats/{module}.
 */
import { get } from './request';
import type { WorkflowModule, WorkflowStatsPayload } from '@/types/workflow';

export async function fetchWorkflowStats(
  factoryId: string,
  module: WorkflowModule,
): Promise<WorkflowStatsPayload> {
  const response = await get<WorkflowStatsPayload>(
    `/${factoryId}/workflow-stats/${module}`,
  );
  return response.data;
}
