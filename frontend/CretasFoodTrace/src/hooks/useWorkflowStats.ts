import { useCallback, useEffect, useState } from 'react';
import { workflowStatsApi } from '../services/api/workflowStatsApiClient';
import type { WorkflowModule, WorkflowStatsPayload } from '../types/workflow';

export interface UseWorkflowStatsResult {
  stats: WorkflowStatsPayload | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * 取单个 module 的工作流统计. 自带 loading/error 状态.
 *
 * Mount 时立刻取一次. 列表/首页 focus 时调 `refresh()` 复用同一 hook 实例
 * (后端 Redis 5min 缓存内 stale-while-warm, 客户端不需节流).
 */
export function useWorkflowStats(
  module: WorkflowModule,
  factoryId?: string,
): UseWorkflowStatsResult {
  const [stats, setStats] = useState<WorkflowStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await workflowStatsApi.fetch(module, factoryId);
      setStats(payload);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [module, factoryId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { stats, loading, error, refresh: fetch };
}
