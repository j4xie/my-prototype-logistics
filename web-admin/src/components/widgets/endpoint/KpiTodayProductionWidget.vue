<script setup lang="ts">
/**
 * KpiTodayProductionWidget — wraps GET /api/mobile/{factoryId}/reports/dashboard/overview
 * Shows today's output (kg) with completion-rate trend.
 *
 * 防呆 R2: KPI 含 context — "今日产量 vs 计划 X%".
 * 防呆 R5: empty state → 跳生产批次页 录第一条.
 */
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import type { DashboardOverview } from '@/types/api';
import Widget from '../Widget.vue';
import { useWidgetData } from '../useWidgetData';

const props = withDefaults(
  defineProps<{
    title?: string;
    autoRefreshMs?: number;
  }>(),
  {
    title: '今日产量',
    autoRefreshMs: 60_000,
  }
);

const router = useRouter();
const authStore = useAuthStore();

const { data, loading, error, lastUpdated, empty, refresh } = useWidgetData<DashboardOverview>({
  fetcher: () => {
    const fid = authStore.factoryId;
    if (!fid) throw new Error('未绑定工厂');
    return get<DashboardOverview>(`/${fid}/reports/dashboard/overview`);
  },
  isEmpty: (d) => !d || ((d.todayOutput ?? 0) === 0 && (d.plannedOutput ?? 0) === 0),
  autoRefreshMs: props.autoRefreshMs,
});

const todayOutput = computed(() => data.value?.todayOutput ?? 0);
const completionRate = computed(() => data.value?.completionRate ?? null);
const plannedOutput = computed(() => data.value?.plannedOutput ?? null);

const contextText = computed(() => {
  if (plannedOutput.value != null && plannedOutput.value > 0) {
    return `计划 ${plannedOutput.value} kg`;
  }
  return '今日累计实际产量';
});

function goToBatches(): void {
  void router.push('/production/batches');
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <Widget
    :title="props.title"
    :loading="loading"
    :error="error"
    :empty="empty"
    :last-updated="lastUpdated"
    empty-message="今日还没有生产数据"
    empty-action-label="录入生产批次"
    @refresh="refresh"
    @empty-action="goToBatches"
  >
    <div class="kpi-tp-body">
      <div class="kpi-tp-value">
        {{ todayOutput.toLocaleString() }}
        <span class="kpi-tp-unit">kg</span>
      </div>
      <div class="kpi-tp-context">{{ contextText }}</div>
      <div v-if="completionRate != null" class="kpi-tp-trend" :class="{ ok: completionRate >= 80 }">
        完成率 {{ completionRate.toFixed(1) }}%
      </div>
    </div>
  </Widget>
</template>

<style scoped>
.kpi-tp-body { display: flex; flex-direction: column; gap: 6px; }
.kpi-tp-value { font-size: 28px; font-weight: 600; color: var(--el-text-color-primary); line-height: 1.2; }
.kpi-tp-unit { font-size: 14px; font-weight: 400; color: var(--el-text-color-secondary); margin-left: 4px; }
.kpi-tp-context { font-size: 12px; color: var(--el-text-color-secondary); }
.kpi-tp-trend { font-size: 12px; color: var(--el-color-warning); }
.kpi-tp-trend.ok { color: var(--el-color-success); }
</style>
