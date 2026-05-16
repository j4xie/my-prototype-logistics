/**
 * Workflow Stats API Client — U-NAV-1 业务流程图导航数据源.
 *
 * 后端 {@link WorkflowStatsController} 5 endpoint, 每个返回 3 节点 (PENDING / IN_PROGRESS / DONE).
 * 后端 5 分钟 Redis 缓存, 客户端不需要额外节流.
 */
import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';
import type { WorkflowModule, WorkflowStatsPayload } from '../../types/workflow';

interface RawResponse {
  success: boolean;
  data: WorkflowStatsPayload;
  message?: string;
}

export const workflowStatsApi = {
  /**
   * 取指定 module 的工作流统计.
   *
   * @param module — sales / purchase / production / finance / inventory
   * @param factoryId — 可选; 工厂用户从登录信息自动获取, 平台管理员需显式传
   */
  fetch: async (
    module: WorkflowModule,
    factoryId?: string,
  ): Promise<WorkflowStatsPayload> => {
    const currentFactoryId = requireFactoryId(factoryId);
    const response = await apiClient.get<RawResponse>(
      `/api/mobile/${currentFactoryId}/workflow-stats/${module}`,
    );
    return response.data;
  },
};
