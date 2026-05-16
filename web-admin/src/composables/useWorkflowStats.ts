import { ref, watch, type Ref } from 'vue';
import { fetchWorkflowStats } from '@/api/workflowStats';
import type { WorkflowModule, WorkflowStatsPayload } from '@/types/workflow';

export interface UseWorkflowStatsResult {
  stats: Ref<WorkflowStatsPayload | null>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  refresh: () => Promise<void>;
}

/**
 * Vue composable — 取单 module 的工作流统计.
 *
 * 跟 RN side useWorkflowStats hook 等价语义. factoryId 必须显式传 (web-admin
 * 一般通过 useAuthStore().factoryId computed 拿到, 跟 RN side requireFactoryId 模式不同).
 * factoryId Ref 变化时自动重新取数.
 */
export function useWorkflowStats(
  factoryId: Ref<string | undefined>,
  module: WorkflowModule,
): UseWorkflowStatsResult {
  const stats = ref<WorkflowStatsPayload | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  async function refresh(): Promise<void> {
    const id = factoryId.value;
    if (!id) {
      stats.value = null;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      stats.value = await fetchWorkflowStats(id, module);
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      loading.value = false;
    }
  }

  watch(
    factoryId,
    () => {
      void refresh();
    },
    { immediate: true },
  );

  return { stats, loading, error, refresh };
}
